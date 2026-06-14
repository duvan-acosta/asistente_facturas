FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css app.js auth.js sync.js admin.js manifest.json sw.js /usr/share/nginx/html/
COPY scripts/dev-credentials.stub.js /usr/share/nginx/html/dev-credentials.js
COPY auth-config.example.js /usr/share/nginx/html/auth-config.js
COPY sync-config.example.js /usr/share/nginx/html/sync-config.js
COPY icons/ /usr/share/nginx/html/icons/

EXPOSE 80