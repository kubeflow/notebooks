FROM alpine:3.18

WORKDIR /app

COPY bin/backend /backend

ENTRYPOINT ["/backend"]