package com.myblog.common;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 바꿀 수 있는 기본값을 한곳에 모은다 (헌법 VI, NF-08).
 * 값은 application.yml의 myblog.* 에 있고, 원본 각 파일의 '기본값' 표를 따른다.
 */
@ConfigurationProperties("myblog")
public record MyBlogProperties(
        Member member,
        Verification verification,
        Login login,
        Session session,
        Blog blog,
        Post post,
        Comment comment,
        Tag tag,
        Report report,
        Image image,
        Search search,
        Views views,
        Trending trending,
        Home home,
        Dashboard dashboard,
        Mail mail,
        Draft draft,
        Notice notice) {

    /** CF-01-3, CF-01-4, CF-15-5 */
    public record Member(int nicknameMin, int nicknameMax, int passwordMin, int passwordMax,
                         String passwordSpecials, int bioMax, Duration withdrawKeep) {}

    /** CF-01-14 ~ 17, CF-01-20 */
    public record Verification(Duration codeTtl, Duration resendInterval, int dailyLimit,
                               int maxAttempts, Duration verifiedTtl) {}

    /** CF-02-5, CF-02-6 */
    public record Login(int maxFailures, Duration lockDuration) {}

    /** CF-02-10 */
    public record Session(Duration timeout, String cookieName, boolean secureCookie) {}

    /** CF-04, CF-08, spec Assumptions(기본 주제) */
    public record Blog(int nameMax, int descriptionMax, int aboutMax, int categoryNameMax,
                       String defaultTopic, String defaultCategoryName, int colorCount,
                       int categoryDescriptionMax, int blogTags) {}

    /** CF-05, CF-10 */
    public record Post(int titleMax, int bodyMax, int excerptLength, int pageSize, int otherPosts, int pinLimit) {}

    /** 임시저장: 회원별 최대 개수, 글쓰기 중 자동 저장 간격 */
    public record Draft(int maxPerMember, Duration autosaveInterval) {}

    /** CF-18, BM-05-2 */
    public record Comment(int bodyMax, Duration cooldown, int previewLength) {}

    /** CF-20 */
    public record Tag(int maxPerPost, int maxLength) {}

    /** CF-21-2 */
    public record Report(int detailMax) {}

    /** CF-22 */
    public record Image(long maxBytes, int maxPerPost, String storage, String diskPath,
                        Duration orphanTtl, S3 s3) {
        public record S3(String endpoint, String region, String bucket, String accessKey, String secretKey) {}
    }

    /** CF-11-1, 요구사항.md 3.8 */
    public record Search(int minLength, int maxLength, Duration logRetention) {}

    /** BM-06-3 */
    public record Views(Duration dedup) {}

    /** 요구사항.md 3.8 */
    public record Trending(int size, Duration interval, Duration window,
                           int searchWeight, int viewWeight, int commentWeight) {}

    /** 요구사항.md 3.2, 3.3, research §12 */
    public record Home(int featured, int latest, int popularDays, int topicPosts, int blogs, int notices) {}

    /** 공지사항: 이 이메일 회원 블로그의 categoryName 다이어리 공개 글. ownerEmail이 비면 공지가 없다 */
    public record Notice(String ownerEmail, String categoryName) {}

    /** BM-02 */
    public record Dashboard(int popularDays, int popularSize, int recentSize, int chartDays) {}

    /** research §4 */
    public record Mail(String mode, String from, String serviceName) {}
}
