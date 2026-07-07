# Wrangler disposition worker.
# R + CmdStan, with the model precompiled into the image so a run never pays
# compile time. Cloud Run Jobs invokes this once per execution; it fits one
# campaign and exits.

FROM rocker/r-ver:4.4.1

# System libraries:
#  - build-essential: CmdStan compiles C++ to fit the model
#  - libpq-dev: RPostgres talks to Supabase Postgres
#  - libcurl/libssl: cmdstanr downloads + TLS to the database
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      libcurl4-openssl-dev \
      libssl-dev \
      ca-certificates \
      curl \
    && rm -rf /var/lib/apt/lists/*

# R packages. cmdstanr is on the Stan R-universe; the rest are on CRAN.
RUN Rscript -e 'install.packages(c("DBI","RPostgres","jsonlite","posterior"), repos="https://cloud.r-project.org")' \
 && Rscript -e 'install.packages("cmdstanr", repos=c("https://stan-dev.r-universe.dev","https://cloud.r-project.org"))'

# Build CmdStan into /opt and pin a stable symlink so CMDSTAN never depends on
# the version number.
RUN Rscript -e 'cmdstanr::install_cmdstan(dir="/opt", cores=2, overwrite=TRUE)' \
 && ln -s /opt/cmdstan-* /opt/cmdstan
ENV CMDSTAN=/opt/cmdstan

WORKDIR /app

# Precompile the model. This produces /app/disposition (the executable) next to
# the source, so at runtime cmdstan_model() sees it's current and skips the
# compile entirely.
COPY disposition.stan /app/disposition.stan
RUN Rscript -e 'cmdstanr::cmdstan_model("/app/disposition.stan")'

COPY run.R /app/run.R

# One execution = one fit, then exit. The campaign id arrives either as the
# first argument or as WRANGLER_CAMPAIGN_ID.
ENTRYPOINT ["Rscript", "/app/run.R"]
