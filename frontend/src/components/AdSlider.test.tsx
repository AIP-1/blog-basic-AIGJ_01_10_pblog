import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AD_INTERVAL_MS, ADS } from '../lib/ads';
import { renderWithProviders } from '../test/utils';
import { AdSlider } from './AdSlider';

const track = () => document.querySelector<HTMLElement>('.ad-track');
const slide = (i: number) => screen.getByRole('link', { name: `${i + 1} / ${ADS.length}` });

describe('광고 슬라이드', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('광고마다 문구와 링크를 보여 주고, 5초마다 다음 광고로 넘어가며 끝에서 처음으로 돌아온다', () => {
    renderWithProviders(<AdSlider />);
    expect(screen.getByRole('region', { name: '광고' })).toHaveAttribute('aria-roledescription', 'carousel');
    expect(screen.getByText(ADS[0].title)).toBeInTheDocument();
    expect(slide(1)).toHaveAttribute('href', ADS[1].href);
    expect(slide(0)).toHaveAttribute('tabindex', '0');
    expect(slide(1)).toHaveAttribute('tabindex', '-1');
    act(() => vi.advanceTimersByTime(AD_INTERVAL_MS));
    expect(track()).toHaveStyle({ transform: 'translateX(-100%)' });
    expect(slide(1)).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: '2번 광고' })).toHaveClass('is-on');
    act(() => vi.advanceTimersByTime(AD_INTERVAL_MS * (ADS.length - 1)));
    expect(track()).toHaveStyle({ transform: 'translateX(-0%)' });
  });

  it('화살표와 점으로 넘기고, 처음에서 이전을 누르면 마지막 광고로 간다', () => {
    renderWithProviders(<AdSlider />);
    fireEvent.click(screen.getByRole('button', { name: '이전 광고' }));
    expect(track()).toHaveStyle({ transform: `translateX(-${(ADS.length - 1) * 100}%)` });
    fireEvent.click(screen.getByRole('button', { name: '다음 광고' }));
    expect(track()).toHaveStyle({ transform: 'translateX(-0%)' });
    fireEvent.click(screen.getByRole('button', { name: '3번 광고' }));
    expect(track()).toHaveStyle({ transform: 'translateX(-200%)' });
  });

  it('마우스를 올리거나 초점이 있으면 멈추고, 떠나면 다시 넘어간다', () => {
    renderWithProviders(<AdSlider />);
    const region = screen.getByRole('region', { name: '광고' });
    fireEvent.mouseEnter(region);
    act(() => vi.advanceTimersByTime(AD_INTERVAL_MS * 2));
    expect(track()).toHaveStyle({ transform: 'translateX(-0%)' });
    fireEvent.mouseLeave(region);
    fireEvent.focus(slide(0));
    act(() => vi.advanceTimersByTime(AD_INTERVAL_MS));
    expect(track()).toHaveStyle({ transform: 'translateX(-0%)' });
    fireEvent.blur(slide(0));
    act(() => vi.advanceTimersByTime(AD_INTERVAL_MS));
    expect(track()).toHaveStyle({ transform: 'translateX(-100%)' });
  });

  it('휴대폰에서 왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전, 조금만 밀면 그대로다', () => {
    renderWithProviders(<AdSlider />);
    const region = screen.getByRole('region', { name: '광고' });
    const swipe = (from: number, to: number) => {
      fireEvent.touchStart(region, { touches: [{ clientX: from }] });
      fireEvent.touchEnd(region, { changedTouches: [{ clientX: to }] });
    };
    swipe(200, 100);
    expect(track()).toHaveStyle({ transform: 'translateX(-100%)' });
    swipe(100, 200);
    expect(track()).toHaveStyle({ transform: 'translateX(-0%)' });
    swipe(100, 120);
    expect(track()).toHaveStyle({ transform: 'translateX(-0%)' });
  });

  it('움직임 줄이기 설정이면 저절로 넘어가지 않는다', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    renderWithProviders(<AdSlider />);
    act(() => vi.advanceTimersByTime(AD_INTERVAL_MS * 3));
    expect(track()).toHaveStyle({ transform: 'translateX(-0%)' });
  });
});
