FROM alpine:3.12

WORKDIR /

COPY bin/manager /manager

ENTRYPOINT ["/manager"]
