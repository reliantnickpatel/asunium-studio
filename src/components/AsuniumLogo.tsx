import Image from "next/image";

type AsuniumLogoProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

export default function AsuniumLogo({
  size = 34,
  showWordmark = false,
  className = "",
  markClassName = "",
  wordmarkClassName = "",
}: AsuniumLogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className={`inline-flex shrink-0 overflow-hidden rounded-lg ${markClassName}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Image
          src="/asunium-logo.png"
          alt="Asunium Studio"
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      </span>
      {showWordmark && (
        <span className={`leading-tight ${wordmarkClassName}`}>
          <span className="block text-sm font-semibold text-white">Asunium Studio</span>
          <span className="block text-[11px] text-slate-500">Document workspace</span>
        </span>
      )}
    </span>
  );
}
