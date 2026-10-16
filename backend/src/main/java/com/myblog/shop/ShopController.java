package com.myblog.shop;

import com.myblog.common.error.ApiException;
import com.myblog.common.error.ErrorCode;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 스티커 상점: 잉크 · 팩 · 내 스티커 · 도전과제 · 다이어리 표지 스티커 */
@RestController
public class ShopController {
    public record StickersRequest(List<DiaryStickerService.Placement> stickers) {}

    private final InkService ink;
    private final StickerService stickers;
    private final ChallengeService challenges;
    private final DiaryStickerService diaryStickers;

    public ShopController(InkService ink, StickerService stickers, ChallengeService challenges,
                          DiaryStickerService diaryStickers) {
        this.ink = ink;
        this.stickers = stickers;
        this.challenges = challenges;
        this.diaryStickers = diaryStickers;
    }

    private static long required(Long me) {
        if (me == null) {
            throw new ApiException(ErrorCode.UNAUTHENTICATED);
        }
        return me;
    }

    /** 내 잉크: 잔액 · 오늘 출석 · 연속 출석 · 오늘 적립 현황 · 최근 내역 */
    @GetMapping("/api/me/ink")
    public Map<String, Object> wallet(@AuthenticationPrincipal Long me) {
        return ink.wallet(required(me));
    }

    /** 하루 첫 출석 (로그인한 화면이 하루 한 번 부른다). 이미 했으면 earned = 0 */
    @PostMapping("/api/shop/checkin")
    public Map<String, Object> checkin(@AuthenticationPrincipal Long me) {
        return ink.dailyCheckin(required(me));
    }

    /** 팩 목록: 누구나 볼 수 있다 */
    @GetMapping("/api/shop/packs")
    public List<Map<String, Object>> packs(@AuthenticationPrincipal Long viewer) {
        return stickers.packs(viewer);
    }

    @PostMapping("/api/shop/packs/{code}/buy")
    public Map<String, Object> buy(@PathVariable String code, @AuthenticationPrincipal Long me) {
        return stickers.buy(required(me), code);
    }

    @GetMapping("/api/me/stickers")
    public List<Map<String, Object>> myStickers(@AuthenticationPrincipal Long me) {
        return stickers.mine(required(me));
    }

    /** 도전과제: 로그인 안 했으면 진행도 0 */
    @GetMapping("/api/shop/challenges")
    public List<Map<String, Object>> challenges(@AuthenticationPrincipal Long viewer) {
        return challenges.list(viewer);
    }

    @PostMapping("/api/shop/challenges/{code}/claim")
    public Map<String, Object> claim(@PathVariable String code, @AuthenticationPrincipal Long me) {
        return challenges.claim(required(me), code);
    }

    /** 다이어리 표지 스티커 여러 개를 한 번에 (책장·인기 다이어리) */
    @GetMapping("/api/diary-stickers")
    public Map<String, List<Map<String, Object>>> diaryStickers(@RequestParam(required = false) List<Long> categoryIds,
                                                                @AuthenticationPrincipal Long viewer) {
        return diaryStickers.of(categoryIds, viewer);
    }

    /** 다이어리 표지 스티커 바꾸기 (주인만, 가진 스티커만) */
    @PutMapping("/api/categories/{id}/stickers")
    public List<Map<String, Object>> placeStickers(@PathVariable long id, @AuthenticationPrincipal Long me,
                                                   @RequestBody StickersRequest req) {
        return diaryStickers.replace(id, required(me), req.stickers());
    }
}
