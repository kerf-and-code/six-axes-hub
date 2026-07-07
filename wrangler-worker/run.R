## ============================================================
## Wrangler — disposition model worker (container entrypoint)
## Args: 1 = campaign id (required), 2 = disposition_runs id (optional).
## When a run id is present, the worker reports its own outcome back to that row:
## 'done' on success, 'error' (with a message) on any failure. Run manually with
## just the campaign id and the status reporting is simply skipped.
## All connection details come from the environment (set by Cloud Run).
## ============================================================

suppressPackageStartupMessages({
  library(DBI); library(RPostgres); library(jsonlite); library(cmdstanr)
})

## ---- config -------------------------------------------------------------
args        <- commandArgs(trailingOnly = TRUE)
CAMPAIGN_ID <- if (length(args) >= 1 && nzchar(args[1])) args[1] else Sys.getenv("WRANGLER_CAMPAIGN_ID")
RUN_ID      <- if (length(args) >= 2 && nzchar(args[2])) args[2] else Sys.getenv("WRANGLER_RUN_ID")
MODEL_VERSION <- "wrangler-disp-v1.0-nb"
ANSWERS_COL   <- "answers"
AXES          <- c("N", "T", "O", "S", "E", "I")
STAN_FILE     <- Sys.getenv("STAN_FILE", "disposition.stan")
stopifnot("Set WRANGLER_CAMPAIGN_ID (env) or pass the campaign id as the first argument" = nzchar(CAMPAIGN_ID))

## Say out loud what we received, so a missing run id is obvious in the logs.
cat(sprintf("[wrangler] campaign=%s run=%s (args received: %d)\n",
            CAMPAIGN_ID, if (nzchar(RUN_ID)) RUN_ID else "(none)", length(args)))

ITEMS <- do.call(rbind, lapply(AXES, function(ax)
  data.frame(id = paste0(tolower(ax), 1:4), axis = ax,
             reverse = c(FALSE, FALSE, FALSE, TRUE), stringsAsFactors = FALSE)))

## ---- connect (direct Postgres; bypasses RLS so the write-back works) -----
con <- dbConnect(RPostgres::Postgres(),
  host     = Sys.getenv("SUPABASE_DB_HOST"),
  port     = as.integer(Sys.getenv("SUPABASE_DB_PORT", "5432")),
  dbname   = Sys.getenv("SUPABASE_DB_NAME", "postgres"),
  user     = Sys.getenv("SUPABASE_DB_USER"),
  password = Sys.getenv("SUPABASE_DB_PASSWORD"),
  sslmode  = "require")

## ---- status reporting back to disposition_runs --------------------------
## No-op when there's no run id (e.g. a manual gcloud run). Never throws.
## The ::uuid cast makes the id comparison unambiguous, and the row count is
## logged so a zero-match can never be silent again.
mark_run <- function(status, msg = NULL) {
  if (!nzchar(RUN_ID)) {
    cat("[wrangler] no run id; skipping status report\n")
    return(invisible())
  }
  tryCatch({
    n <- dbExecute(con,
      "update disposition_runs set status = $1, error = $2 where id = $3::uuid",
      params = list(status, if (is.null(msg)) NA_character_ else substr(msg, 1, 500), RUN_ID))
    cat(sprintf("[wrangler] run row update: %s, %d row(s)\n", status, n))
  }, error = function(e) cat(sprintf("[wrangler] could not update run row: %s\n", conditionMessage(e))))
}

## Everything past the connection runs inside a handler so any failure is
## reported to the run row (and exits non-zero so Cloud Run marks it failed too).
tryCatch({

  ## ---- pull -------------------------------------------------------------
  opp <- dbGetQuery(con, "
    select e.session_id, e.axis, count(*)::int as opp
    from events e join event_types et on et.key = e.event_type
    where e.campaign_id = $1 and et.category = 'opportunity' and e.axis is not null
    group by e.session_id, e.axis", params = list(CAMPAIGN_ID))

  resp <- dbGetQuery(con, "
    select e.character_id, e.session_id, e.axis, count(*)::int as resp
    from events e join event_types et on et.key = e.event_type
    where e.campaign_id = $1 and et.category = 'response'
      and e.axis is not null and e.character_id is not null
    group by e.character_id, e.session_id, e.axis", params = list(CAMPAIGN_ID))

  pcs <- dbGetQuery(con, "
    select id, name, profile_id from characters
    where campaign_id = $1 and kind = 'pc'", params = list(CAMPAIGN_ID))

  tpdi <- dbGetQuery(con, sprintf("
    select assigned_character_id as character_id, %s::text as answers
    from tpdi_responses
    where campaign_id = $1 and assigned_character_id is not null", ANSWERS_COL),
    params = list(CAMPAIGN_ID))

  sess_meta <- dbGetQuery(con, "
    select id, session_number from sessions where campaign_id = $1",
    params = list(CAMPAIGN_ID))

  if (nrow(opp) == 0) stop("No opportunity events with an axis in this campaign. The model needs exposure.")
  if (nrow(pcs) == 0) stop("No player characters in this campaign.")

  ## ---- indices ----------------------------------------------------------
  sessions <- sort(unique(opp$session_id))
  Cn <- nrow(pcs); Sn <- length(sessions); An <- length(AXES)
  ci <- setNames(seq_len(Cn), pcs$id)
  si <- setNames(seq_len(Sn), sessions)
  ai <- setNames(seq_len(An), AXES)

  ## ---- observation grid -------------------------------------------------
  cells <- opp[, c("session_id", "axis", "opp")]
  grid  <- merge(data.frame(character_id = pcs$id, stringsAsFactors = FALSE), cells, by = NULL)
  Rmap  <- setNames(resp$resp, paste(resp$character_id, resp$session_id, resp$axis))
  gk    <- paste(grid$character_id, grid$session_id, grid$axis)
  grid$y    <- as.integer(ifelse(is.na(Rmap[gk]), 0L, Rmap[gk]))
  grid$logE <- log(grid$opp)

  ## ---- TPDI -> standardized prior z[C, A] -------------------------------
  z <- matrix(0, nrow = Cn, ncol = An, dimnames = list(pcs$id, AXES))
  n_bound <- 0L
  for (r in seq_len(nrow(tpdi))) {
    cid <- tpdi$character_id[r]; if (!(cid %in% pcs$id)) next
    ans <- tryCatch(fromJSON(tpdi$answers[r]), error = function(e) NULL); if (is.null(ans)) next
    n_bound <- n_bound + 1L
    for (ax in AXES) {
      its  <- ITEMS[ITEMS$axis == ax, ]
      vals <- c()
      for (k in seq_len(nrow(its))) {
        raw <- ans[[its$id[k]]]
        if (is.null(raw) || identical(as.character(raw), "NB")) next
        raw <- suppressWarnings(as.numeric(raw)); if (is.na(raw)) next
        vals <- c(vals, if (its$reverse[k]) 6 - raw else raw)
      }
      if (length(vals) > 0) z[cid, ax] <- (mean(vals) - 3) / 1.2
    }
  }
  cat(sprintf("[wrangler] characters: %d | bound inventories: %d | sessions: %d | obs: %d\n",
              Cn, n_bound, Sn, nrow(grid)))

  ## ---- fit --------------------------------------------------------------
  stan_data <- list(
    N = nrow(grid), C = Cn, S = Sn, A = An,
    y = grid$y, logE = grid$logE,
    cc = as.integer(ci[grid$character_id]),
    ss = as.integer(si[grid$session_id]),
    aa = as.integer(ai[grid$axis]),
    z  = z)

  mod <- cmdstan_model(STAN_FILE)
  fit <- mod$sample(data = stan_data, chains = 4, parallel_chains = 4,
                    iter_warmup = 1000, iter_sampling = 1000,
                    adapt_delta = 0.95, refresh = 200, seed = 1)

  summ <- fit$summary("theta")
  cat("\n[wrangler] self-report -> behavior loadings (beta per axis):\n")
  print(fit$summary("beta")[, c("variable", "mean", "q5", "q95")])

  inv_logit <- function(x) 1 / (1 + exp(-x))
  val <- function(c_idx, a_idx, field) {
    summ[summ$variable == sprintf("theta[%d,%d]", c_idx, a_idx), ][[field]]
  }

  ## ---- write back -------------------------------------------------------
  dbExecute(con, "delete from dispositions where campaign_id = $1 and source = 'posterior' and model_version = $2",
            params = list(CAMPAIGN_ID, MODEL_VERSION))

  latest_sess <- sessions[ which.max(sess_meta$session_number[match(sessions, sess_meta$id)]) ]
  written <- 0L; skipped <- character(0)

  for (i in seq_len(Cn)) {
    pid <- pcs$profile_id[i]
    if (is.na(pid) || pid == "") { skipped <- c(skipped, pcs$name[i]); next }
    ax_scores <- list(); wts <- list()
    for (a in seq_len(An)) {
      m <- val(i, a, "mean"); sdv <- val(i, a, "sd"); lo <- val(i, a, "q5"); hi <- val(i, a, "q95")
      ax_scores[[AXES[a]]] <- round(inv_logit(m), 4)
      wts[[AXES[a]]]       <- list(theta_mean = round(m, 4), theta_sd = round(sdv, 4),
                                   lo = round(lo, 4), hi = round(hi, 4))
    }
    dbExecute(con, "
      insert into dispositions
        (profile_id, campaign_id, character_id, source, axis_scores, weights, model_version, session_id, as_of)
      values ($1, $2, $3, 'posterior', $4::jsonb, $5::jsonb, $6, $7, now())",
      params = list(pid, CAMPAIGN_ID, pcs$id[i],
                    as.character(toJSON(ax_scores, auto_unbox = TRUE)),
                    as.character(toJSON(wts, auto_unbox = TRUE)),
                    MODEL_VERSION, latest_sess))
    written <- written + 1L
  }

  cat(sprintf("\n[wrangler] wrote %d posterior rows. Skipped (no bound owner): %s\n",
              written, if (length(skipped)) paste(skipped, collapse = ", ") else "none"))

  ## ---- tidy CSV (ephemeral; for log/debug only) -------------------------
  out <- do.call(rbind, lapply(seq_len(Cn), function(i) do.call(rbind, lapply(seq_len(An), function(a)
    data.frame(character = pcs$name[i], axis = AXES[a],
               theta_mean = val(i, a, "mean"), theta_sd = val(i, a, "sd"),
               lo = val(i, a, "q5"), hi = val(i, a, "q95"),
               engagement01 = inv_logit(val(i, a, "mean")), z_prior = z[i, a],
               stringsAsFactors = FALSE)))))
  write.csv(out, file.path(tempdir(), "disposition_posteriors.csv"), row.names = FALSE)

  ## ---- success ----------------------------------------------------------
  mark_run("done")
  cat("[wrangler] done.\n")

}, error = function(e) {
  msg <- conditionMessage(e)
  cat(sprintf("[wrangler] ERROR: %s\n", msg))
  mark_run("error", msg)
  try(dbDisconnect(con), silent = TRUE)
  quit(save = "no", status = 1)
})

try(dbDisconnect(con), silent = TRUE)
