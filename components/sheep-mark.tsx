type SheepMarkProps = {
  className?: string;
};

/**
 * 治愈系小羊「xylamb」品牌符号。
 * 用于空状态插画与 AI 助手头像，统一这个体重看板的视觉印记。
 */
export function SheepMark({ className = "h-12 w-12 text-primary" }: SheepMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 蓬松羊毛（头顶卷毛） */}
      <path d="M19 30a6 6 0 0 1-1-11.8A6 6 0 0 1 29 14.5a6.5 6.5 0 0 1 11 .5a6 6 0 0 1 6 11" />
      {/* 脸 */}
      <path d="M23 30a9 8 0 0 0 18 0a9 8 0 0 0-18 0Z" fill="currentColor" fillOpacity="0.08" />
      {/* 耳朵 */}
      <path d="M23.5 30c-3.2 0-5.5 1.6-6 4M40.5 30c3.2 0 5.5 1.6 6 4" />
      {/* 眼睛 */}
      <path d="M29 30h.02M35 30h.02" />
      {/* 微笑 */}
      <path d="M29.8 34c1.4 1.2 3 1.2 4.4 0" />
      {/* 四条腿带蹄 */}
      <path d="M27 40v5l1.8 .6M31.5 40v5M36.5 40v5M41 40v5l-1.8 .6" />
    </svg>
  );
}
