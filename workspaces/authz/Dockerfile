# Use the golang image to build the application
FROM --platform=$BUILDPLATFORM golang:1.26 AS builder
ARG TARGETOS
ARG TARGETARCH

WORKDIR /workspace
ENV GOTOOLCHAIN=auto

# Copy the Go Modules manifests and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the go source files
COPY cmd/ cmd/
COPY internal/ internal/

# Build the Go application
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} go build -a -o authz ./cmd/main.go

# Use distroless as minimal base image to package the application binary
FROM gcr.io/distroless/static:nonroot
WORKDIR /
COPY --from=builder /workspace/authz ./
USER 65532:65532

# ext_authz gRPC and forward-auth HTTP
EXPOSE 9001 9002

ENTRYPOINT ["/authz"]
