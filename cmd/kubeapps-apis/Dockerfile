# Copyright 2021-2022 the Kubeapps contributors.
# SPDX-License-Identifier: Apache-2.0

# syntax = docker/dockerfile:1

FROM bitnami/golang:1.20.5 as builder
WORKDIR /go/src/github.com/vmware-tanzu/kubeapps
COPY go.mod go.sum ./
ARG VERSION="devel"

ARG BUF_VERSION="1.13.1"
ARG GOLANGCILINT_VERSION="1.50.1"

# Install lint tools
RUN curl -sSL "https://github.com/bufbuild/buf/releases/download/v$BUF_VERSION/buf-Linux-x86_64" -o "/tmp/buf" && chmod +x "/tmp/buf"
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@v$GOLANGCILINT_VERSION


# With the trick below, Go's build cache is kept between builds.
# https://github.com/golang/go/issues/27719#issuecomment-514747274
RUN --mount=type=cache,target=/go/pkg/mod  \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

# We don't copy the pkg and cmd directories until here so the above layers can
# be reused.
COPY pkg pkg
COPY cmd cmd

# If true, run golangci-lint to detect issues
ARG lint

RUN if [ ! -z "$lint" ]; then \
    # Run golangci-lint to detect issues
    golangci-lint run --timeout=10m ./cmd/kubeapps-apis/... && \
    golangci-lint run --timeout=10m ./pkg/...; \
    fi

# Lint the proto files to detect errors at build time
RUN /tmp/buf lint ./cmd/kubeapps-apis

# Build the main grpc server
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build \
    -ldflags "-X github.com/vmware-tanzu/kubeapps/cmd/kubeapps-apis/cmd.version=$VERSION" \
    ./cmd/kubeapps-apis

# Build 'kapp-controller' plugin, version 'v1alpha1'
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build \
    -ldflags "-X github.com/vmware-tanzu/kubeapps/cmd/kubeapps-apis/cmd.version=$VERSION" \
    -o /kapp-controller-packages-v1alpha1-plugin.so -buildmode=plugin \
    ./cmd/kubeapps-apis/plugins/kapp_controller/packages/v1alpha1/*.go

## Build 'fluxv2' plugin, version 'v1alpha1'
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build \
    -ldflags "-X github.com/vmware-tanzu/kubeapps/cmd/kubeapps-apis/cmd.version=$VERSION" \
    -o /fluxv2-packages-v1alpha1-plugin.so -buildmode=plugin \
    ./cmd/kubeapps-apis/plugins/fluxv2/packages/v1alpha1/*.go

## Build 'helm' plugin, version 'v1alpha1'
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build \
    -ldflags "-X github.com/vmware-tanzu/kubeapps/cmd/kubeapps-apis/cmd.version=$VERSION" \
    -o /helm-packages-v1alpha1-plugin.so -buildmode=plugin \
    ./cmd/kubeapps-apis/plugins/helm/packages/v1alpha1/*.go

## Build 'resources' plugin, version 'v1alpha1'
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build \
    -ldflags "-X github.com/vmware-tanzu/kubeapps/cmd/kubeapps-apis/cmd.version=$VERSION" \
    -o /resources-v1alpha1-plugin.so -buildmode=plugin \
    ./cmd/kubeapps-apis/plugins/resources/v1alpha1/*.go

# Remove and instead use built-in gRPC container probes once we're
# supporting >= 1.24 only. https://kubernetes.io/blog/2022/05/13/grpc-probes-now-in-beta/
RUN GRPC_HEALTH_PROBE_VERSION=v0.4.18 && \
    curl -sSL "https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/${GRPC_HEALTH_PROBE_VERSION}/grpc_health_probe-linux-amd64" -o "/bin/grpc_health_probe" && chmod +x "/bin/grpc_health_probe"

# Note: unlike the other docker images for go, we cannot use scratch as the plugins
# are loaded using the dynamic linker.
FROM bitnami/minideb:bullseye
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /go/src/github.com/vmware-tanzu/kubeapps/kubeapps-apis /kubeapps-apis
COPY --from=builder /kapp-controller-packages-v1alpha1-plugin.so /plugins/kapp-controller-packages/
COPY --from=builder /fluxv2-packages-v1alpha1-plugin.so /plugins/fluxv2-packages/
COPY --from=builder /helm-packages-v1alpha1-plugin.so /plugins/helm-packages/
COPY --from=builder /resources-v1alpha1-plugin.so /plugins/resources/
COPY --from=builder /bin/grpc_health_probe /bin/

# Ensure the container user will be able to write to the k8s discovery client cache.
RUN mkdir -p /.kube/cache && chown 1001:1001 /.kube/cache

EXPOSE 50051
USER 1001
ENTRYPOINT [ "/kubeapps-apis" ]
CMD [ "--help" ]
