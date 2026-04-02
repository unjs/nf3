FROM node:22-bookworm

# Install build dependencies for node-gyp and native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 python-is-python3 \
  make \
  g++ \
  gcc \
  libc-dev \
  libvips-dev \
  libpixman-1-dev \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  libsqlite3-dev \
  libgl-dev libgles-dev libglew-dev mesa-common-dev \
  libkrb5-dev \
  libx11-dev libxtst-dev libpng-dev \
  libssh2-1-dev libcurl4-openssl-dev \
  cmake \
  pkg-config \
  && rm -rf /var/lib/apt/lists/*

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

# Copy project files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build the project so trace.ts can import from src/
RUN pnpm build

ENTRYPOINT ["bun", "run"]
