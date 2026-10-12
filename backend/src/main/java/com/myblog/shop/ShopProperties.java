package com.myblog.shop;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 스티커 상점 규칙 (application.yml의 myblog.shop.*).
 * 잉크는 활동으로 모은다: 하루 첫 출석, 공개 글 쓰기(하루 postDailyMax번까지), 다른 사람 글에 댓글(하루 commentDailyMax번까지).
 */
@ConfigurationProperties("myblog.shop")
public record ShopProperties(int checkinInk, int postInk, int postDailyMax, int commentInk, int commentDailyMax,
                             int stickersPerDiary, int historySize) {}
