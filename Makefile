.DEFAULT_GOAL := default
SHELL := /bin/bash

# A phony target is one that is not really the name of a file;
# It is just a name for a recipe to be executed when you make an explicit request.
.PHONY: archive build build-fast checkstyle clean clean-all clean-build clean-deps \
        clean-client-deps clean-server-deps clean-tmp coverage default install \
        lint rebuild reinstall run run-all test test-browser \
        test-server

NPM=npm

BIN=node_modules/.bin
BOWER=$(BIN)/bower
GULP=$(BIN)/gulp
KARMA=node_modules/karma/bin/karma

build:
	@$(GULP) build

build-dev:
	@$(GULP) build --no-minify

clean:
	@rm -rf .tmp coverage *.tar.gz public

clean-all: clean
	@rm -rf node_modules client/vendor

default:
	@$(MAKE) install
	@[[ ! -f config/local.json ]] && cp config/dev.json config/local.json
	@$(MAKE) build test

install:
	@$(NPM) install

lint:
	@$(GULP) lint

rebuild: reinstall build

reinstall: clean-all
	@$(NPM) install

run:
	@$(GULP) run:fast:build

test:
	@$(GULP) test

test-browser:
	@gulp build:site:tests
	@open test/client/index.html
