import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatShortDay } from '../../lib/format';
import { useTheme } from '../../lib/theme';

/** 그래프 색은 variables.css 의 토큰을 읽는다 (SVG 속성에는 var() 를 쓸 수 없어서). */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function chartColors() {
  return {
    views: token('--chart-views', '#c4323a'),
    visitors: token('--chart-visitors', '#5b7fb8'),
    comments: token('--chart-comments', '#8a6fc4'),
    grid: token('--chart-grid', '#e6e8ec'),
    axis: token('--chart-axis', '#9aa0aa'),
    hover: token('--surface-2', '#f6f7f9'),
  };
}

// 말풍선은 HTML 이라 var() 를 바로 쓴다 (야간모드에서도 읽히게)
const tooltipStyle = (grid: string) => ({ borderRadius: 8, borderColor: grid, fontSize: 12, background: 'var(--surface)', color: 'var(--text)' });
const legendStyle = { fontSize: 12, paddingBottom: 8 };

interface ViewsPoint {
  date: string;
  views: number;
  visitors: number;
}

/** 일별 조회수·방문자 선 그래프 (BM-02-2, BM-06-2) */
export function ViewsChart({ data, height = 260 }: Readonly<{ data: ViewsPoint[]; height?: number }>) {
  useTheme(); // 야간모드가 바뀌면 다시 그려 토큰을 새로 읽는다
  const c = chartColors();
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatShortDay} tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} width={44} />
          <Tooltip labelFormatter={String} contentStyle={tooltipStyle(c.grid)} />
          <Legend verticalAlign="top" align="right" iconType="plainline" iconSize={10} itemSorter={null} wrapperStyle={legendStyle} />
          <Line type="linear" dataKey="views" name="조회수" stroke={c.views} strokeWidth={2} dot={{ r: 2, strokeWidth: 0, fill: c.views }} activeDot={{ r: 4 }} />
          <Line type="linear" dataKey="visitors" name="방문자" stroke={c.visitors} strokeWidth={2} dot={{ r: 2, strokeWidth: 0, fill: c.visitors }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 일별 댓글 수 막대 그래프 (BM-06-2) */
export function CommentsChart({ data, height = 200 }: Readonly<{ data: { date: string; comments: number }[]; height?: number }>) {
  useTheme(); // 야간모드가 바뀌면 다시 그려 토큰을 새로 읽는다
  const c = chartColors();
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatShortDay} tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} width={44} />
          <Tooltip contentStyle={tooltipStyle(c.grid)} cursor={{ fill: c.hover }} />
          <Bar dataKey="comments" name="댓글" fill={c.comments} radius={[3, 3, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
