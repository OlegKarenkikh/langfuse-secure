WEB_IMAGE    := langfuse-secure
WORKER_IMAGE := langfuse-worker-secure
TAG          := $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)

.PHONY: build build-web build-worker scan scan-web scan-worker clean

build: build-web build-worker

build-web:
	docker build -f Dockerfile -t $(WEB_IMAGE):$(TAG) .
	@echo "Built web: $(WEB_IMAGE):$(TAG)"

build-worker:
	docker build -f Dockerfile.worker -t $(WORKER_IMAGE):$(TAG) .
	@echo "Built worker: $(WORKER_IMAGE):$(TAG)"

scan: scan-web scan-worker

scan-web: build-web
	trivy image \
		--ignorefile .trivyignore \
		--ignore-unfixed \
		--severity CRITICAL,HIGH,MEDIUM \
		$(WEB_IMAGE):$(TAG)

scan-worker: build-worker
	trivy image \
		--ignorefile .trivyignore \
		--ignore-unfixed \
		--severity CRITICAL,HIGH,MEDIUM \
		$(WORKER_IMAGE):$(TAG)

clean:
	docker rmi $(WEB_IMAGE):$(TAG) $(WORKER_IMAGE):$(TAG) 2>/dev/null || true
