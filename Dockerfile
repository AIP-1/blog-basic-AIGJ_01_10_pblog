# 화면(React)과 서버(Spring Boot)를 이미지 하나로 묶는다. 서버가 화면 파일도 함께 내보낸다.
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts   # 의존성의 설치 스크립트는 실행하지 않는다 (공급망 공격 방지)
COPY frontend/ ./
RUN npm run build

FROM eclipse-temurin:21-jdk AS backend
WORKDIR /app/backend
COPY backend/ ./
COPY --from=frontend /app/frontend/dist/ src/main/resources/static/
RUN chmod +x gradlew && ./gradlew bootJar -x test --no-daemon -q

FROM eclipse-temurin:21-jre
WORKDIR /app
ENV TZ=Asia/Seoul \
    SERVER_PORT=8390 \
    MYBLOG_IMAGE_DISK_PATH=/data/images
COPY --from=backend /app/backend/build/libs/*.jar app.jar
VOLUME /data/images
EXPOSE 8390
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
