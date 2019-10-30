PROJECT_PATH := $(abspath $(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

PACKAGE_PATH = $(PROJECT_PATH)/package

IMAGE_NAME = neuvector-vsts

IMAGE_TAG = latest

IMAGE_BUILD_ARGS = 
	#--no-cache

# Extension meta data

EXTENSION_MANIFEST_PATH = $(PROJECT_PATH)/vss-extension.json

EXTENSION_ID = $(shell jq --raw-output '.id' $(EXTENSION_MANIFEST_PATH))

EXTENSION_NAME = $(shell jq --raw-output '.name' $(EXTENSION_MANIFEST_PATH))

EXTENSION_VERSION = $(shell jq --raw-output '.version' $(EXTENSION_MANIFEST_PATH))

EXTENSION_PUBLISHER = $(shell jq --raw-output '.publisher' $(EXTENSION_MANIFEST_PATH))

# Use Docker Buildkit as image build frontend
export DOCKER_BUILDKIT=1

# Include variables from .env if present
-include .env

AZURE_DEVOPS_TOKEN ?= 

AZURE_PUBLISHER ?= 

# Space separated list of Azure DevOps organization to share the privately published extension with
SHARE_WITH_ORGANIZATIONS = \
	dominik-lekse

.PHONY: image
image:
	docker build \
		--tag $(IMAGE_NAME):$(IMAGE_TAG) \
		$(IMAGE_BUILD_ARGS) \
		$(PROJECT_PATH)

.PHONY: shell
shell:
	docker run \
		-it --rm \
		--workdir "/work" \
		--mount source=$(IMAGE_NAME)-yarn,target=/usr/local/share/.cache/yarn \
		--mount source=$(IMAGE_NAME)-node-modules,target=/work/tasks/scan/node_modules \
		--volume "$(PROJECT_PATH):/work" \
		--entrypoint /bin/bash \
		$(IMAGE_NAME):$(IMAGE_TAG)

.PHONY: dependencies
dependencies:
	cd $(PROJECT_PATH)/tasks/scan && yarn install

.PHONY: build
build:
	tsc --project $(PROJECT_PATH)/tasks/scan

.PHONY: continuous-build
continuous-build:
	tsc --project $(PROJECT_PATH)/tasks/scan --watch

.PHONY: test
test: build
	cd $(PROJECT_PATH)/tasks/scan/tests && rm *.js.log || true
	cd $(PROJECT_PATH)/tasks/scan && TASK_TEST_TRACE=1 mocha tests/_suite.js

# .PHONY: verify
# verify:

.PHONY: test-package
test-package:
	echo "Not implemented"

EXTENSION_PACKAGE_PATH = package/$(EXTENSION_PUBLISHER).$(EXTENSION_ID)-$(EXTENSION_VERSION).vsix

# tfx extension create --help
$(EXTENSION_PACKAGE_PATH): build
	mkdir -p $(PACKAGE_PATH)
	tfx extension create --manifests $(EXTENSION_MANIFEST_PATH) --output-path $(PACKAGE_PATH)

.PHONY: package
package: $(EXTENSION_PACKAGE_PATH)

# TODO create test package

# TODO run extension tests before publish

# TODO implement test-publish

# tfx extension publish --help
.PHONY: publish
publish: package
ifneq ($(AZURE_DEVOPS_TOKEN),)
	tfx extension publish --vsix $(PROJECT_PATH)/$(EXTENSION_PACKAGE_PATH) --auth-type pat --token $(AZURE_DEVOPS_TOKEN)
else
	tfx extension publish --vsix $(PROJECT_PATH)/$(EXTENSION_PACKAGE_PATH)
endif

.PHONY: package-publish
package-publish:
ifneq ($(AZURE_DEVOPS_TOKEN),)
	tfx extension publish --manifests $(PROJECT_PATH)/vss-extension.json --auth-type pat --token $(AZURE_DEVOPS_TOKEN)
else
	tfx extension publish --manifests $(PROJECT_PATH)/vss-extension.json
endif

# tfx extension share --help
# --share-with List of Azure DevOps organization(s) with which to share the extension (space separated).
.PHONY: share
share:
ifneq ($(AZURE_DEVOPS_TOKEN),)
	tfx extension share --publisher $(EXTENSION_PUBLISHER) --extension-id $(EXTENSION_ID) --share-with $(SHARE_WITH_ORGANIZATIONS) --auth-type pat --token $(AZURE_DEVOPS_TOKEN)
else
	tfx extension share --publisher $(EXTENSION_PUBLISHER) --extension-id $(EXTENSION_ID) --share-with $(SHARE_WITH_ORGANIZATIONS)
endif
