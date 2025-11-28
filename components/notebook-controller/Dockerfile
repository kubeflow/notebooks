# Build the manager binary
#
# The Docker context is expected to be:
#
# ${PATH_TO_KUBEFLOW/KUBEFLOW repo}/components
#
ARG GOLANG_VERSION=1.24
FROM golang:${GOLANG_VERSION} as builder

WORKDIR /workspace

# Copy the Go Modules manifests
COPY notebook-controller /workspace/notebook-controller

# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN cd /workspace/notebook-controller && go mod download

# Force download and extract all HashiCorp modules so they exist under /go/pkg/mod
RUN set -e; cd /workspace/notebook-controller; \
  for m in $(go list -m all | awk '/^github.com\/hashicorp\// {print $1 "@" $2}'); do \
    go mod download "$m"; \
    pkg="${m%@*}"; \
    go list "$pkg/..." >/dev/null 2>&1 || true; \
  done

WORKDIR /workspace/notebook-controller

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -a -o manager main.go

# Use distroless as minimal base image to package the manager binary
# Refer to https://github.com/GoogleContainerTools/distroless for more details
FROM gcr.io/distroless/static:nonroot

WORKDIR /
COPY --from=builder /workspace/notebook-controller/manager .
COPY --from=builder /workspace/notebook-controller/third_party/license.txt third_party/license.txt
COPY --from=builder /go/pkg/mod/github.com/hashicorp third_party/hashicorp

USER 65532:65532

ENTRYPOINT ["/manager"]
