.PHONY: build clean submodule

submodule:
	git submodule update --init --recursive pi-gen

build: submodule
	cp config pi-gen/config
	cd pi-gen && sudo CLEAN=1 ./build-docker.sh -c ../config
	@echo "Image: pi-gen/deploy/"
	@ls -lh pi-gen/deploy/*.img.xz || true

clean:
	sudo rm -rf pi-gen/work pi-gen/deploy
