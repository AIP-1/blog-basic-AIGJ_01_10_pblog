package com.myblog.image;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** 사진 데이터는 배열의 주소가 아니라 내용으로 비교한다. */
class ImageRecordTest {

    @Test
    void equalsAndHashCodeUseByteContent() {
        var a = new ImageService.Image(new byte[] {1, 2, 3}, "image/png");
        var same = new ImageService.Image(new byte[] {1, 2, 3}, "image/png");
        var otherBytes = new ImageService.Image(new byte[] {1, 2, 4}, "image/png");
        var otherType = new ImageService.Image(new byte[] {1, 2, 3}, "image/jpeg");

        assertThat(a).isEqualTo(same).hasSameHashCodeAs(same);
        assertThat(a).isNotEqualTo(otherBytes).isNotEqualTo(otherType).isNotEqualTo("image/png");
    }

    @Test
    void toStringShowsSizeNotBytes() {
        assertThat(new ImageService.Image(new byte[10], "image/png")).hasToString("Image[10 bytes, image/png]");
        assertThat(new ImageService.Image(null, null)).hasToString("Image[0 bytes, null]");
    }
}
