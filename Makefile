IMAGE_NAME  := langfuse-secure
IMAGE_TAG   := $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
FULL_IMAGE  := $(IMAGE_NAME):$(IMAGE_TAG)

.PHONY: build scan shell clean

build:
	docker build -t $(FULL_IMAGE) .
	@echo "Built: $(FULL_IMAGE)"

scan: build
	trivy image \
		--ignorefile .trivyignore \
		--ignore-unfixed \
		--severity CRITICAL,HIGH,MEDIUM \
		$(FULL_IMAGE)

shell: build
	docker run --rm -it $(FULL_IMAGE) sh

clean:
	docker rmi $(FULL_IMAGE) 2>/dev/null || true
