# reader, serving the directory mounted at /docs:
#
#   docker run -p 127.0.0.1:8734:8734 -v ~/notes:/docs jzheaux/reader
#
# Options given after the image name are added to the ones here, so
# `... jzheaux/reader --allow-host nas.local` lets the NAS be reached by name.
FROM node:26-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY bin bin
COPY src src
COPY static static
COPY features features

# The image's own user, uid 1000, owns /docs when it's a volume of Docker's;
# a directory from the host keeps its owner, so it needs to be writable by
# 1000, or run as its owner with --user.
RUN mkdir /docs && chown node:node /docs
USER node
VOLUME /docs
EXPOSE 8734

ENTRYPOINT ["node", "bin/reader.js", "/docs", "--host", "0.0.0.0", "--port", "8734", "--no-browser"]
CMD []
