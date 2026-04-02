#!/bin/bash
set -e

IMAGE_NAME="nf3"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Build the image if it doesn't exist or --build flag is passed
if [ "$1" = "--build" ]; then
  shift
  echo "Rebuilding $IMAGE_NAME image..."
  docker build -t "$IMAGE_NAME" -f "$ROOT_DIR/scripts/Dockerfile" "$ROOT_DIR"
elif ! docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
  echo "Building $IMAGE_NAME image..."
  docker build -t "$IMAGE_NAME" -f "$ROOT_DIR/scripts/Dockerfile" "$ROOT_DIR"
fi

DOCKER_RUN="docker run --rm -v $ROOT_DIR/src:/app/src -v $ROOT_DIR/scripts:/app/scripts"

if [ $# -eq 0 ]; then
  $DOCKER_RUN --entrypoint /bin/sh "$IMAGE_NAME" -c "bun scripts/analyze.ts && bun scripts/trace.ts"
else
  CMD="$1"
  shift
  case "$CMD" in
    analyze) $DOCKER_RUN "$IMAGE_NAME" scripts/analyze.ts "$@" ;;
    trace)   $DOCKER_RUN "$IMAGE_NAME" scripts/trace.ts "$@" ;;
    sh)      $DOCKER_RUN --entrypoint /bin/sh -it "$IMAGE_NAME" "$@" ;;
    *)       $DOCKER_RUN "$IMAGE_NAME" "$CMD" "$@" ;;
  esac
fi
