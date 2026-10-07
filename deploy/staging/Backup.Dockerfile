FROM postgres:16-alpine
RUN apk add --no-cache age
COPY deploy/staging/backup.sh /usr/local/bin/backup.sh
COPY deploy/staging/backup.crontab /etc/crontabs/root
RUN chmod 0755 /usr/local/bin/backup.sh && chmod 0600 /etc/crontabs/root
CMD ["crond", "-f", "-l", "2"]
