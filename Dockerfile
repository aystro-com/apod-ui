# syntax=docker/dockerfile:1
#
# Packages the prebuilt SPA (dist/) behind nginx. The build is NOT done here —
# run `npm ci && npm run build` first (CI does this), then build the image.
# nginx serves the static files and reverse-proxies /api and /webhook to the
# apod daemon's unix socket (bind-mounted by the apod-ui driver).
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
# nginx:alpine's default CMD runs nginx in the foreground
