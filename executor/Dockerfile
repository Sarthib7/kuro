# --- builder ---
FROM rust:1.88-slim-bookworm AS builder

# System deps required by solana-sdk transitive crates: openssl-sys (libssl-dev,
# pkg-config), libudev-sys (libudev-dev), some protobuf consumers
# (protobuf-compiler), and ca-certs for downloading crates.
RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config libssl-dev libudev-dev protobuf-compiler ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Limit cargo parallelism because the full solana-sdk graph can OOM smaller
# hosted builders at default parallelism.
ENV CARGO_BUILD_JOBS=2

COPY Cargo.toml Cargo.lock ./
COPY src ./src

RUN cargo build --release --locked --bin kuro-executor

# --- runtime ---
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/target/release/kuro-executor /usr/local/bin/kuro-executor

ENV PORT=8080
EXPOSE 8080
CMD ["kuro-executor"]
