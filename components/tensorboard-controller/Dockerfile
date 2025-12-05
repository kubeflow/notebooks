# Build the manager binary
# The Docker context is expected to be:
#
# ${PATH_TO_KUBEFLOW/KUBEFLOW repo}/components
#
FROM golang:1.24 as builder

WORKDIR /workspace
# Copy the Go Modules manifests
COPY tensorboard-controller/go.mod go.mod
COPY tensorboard-controller/go.sum go.sum
# cache deps before building and copying source so that we don't need to re-download as much
# and so that source changes don't invalidate our downloaded layer
RUN go mod download

# Copy the go source
COPY tensorboard-controller/main.go main.go
COPY tensorboard-controller/api/ api/
COPY tensorboard-controller/controllers/ controllers/
COPY tensorboard-controller/reconcilehelper/ reconcilehelper/

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -a -o manager main.go

# Use distroless as minimal base image to package the manager binary
# Refer to https://github.com/GoogleContainerTools/distroless for more details
FROM gcr.io/distroless/static:nonroot
WORKDIR /
COPY --from=builder /workspace/manager .
USER 65532:65532

ENTRYPOINT ["/manager"]
