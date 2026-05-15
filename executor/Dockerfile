# SMOKE TEST — verifying any Docker build works on Railway before debugging the
# full Rust build. Will be reverted to the real solana-sdk Dockerfile once we
# know the Railway pipeline is healthy.
FROM alpine:3.20
RUN echo "kuro smoke test" > /smoke.txt
CMD ["sh", "-c", "echo 'kuro smoke test - sleeping forever to keep container up'; sleep infinity"]
