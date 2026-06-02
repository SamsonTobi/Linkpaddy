import React from "react";
import { ArrowBendDoubleUpRight } from "@phosphor-icons/react";

type ButtonVariant =
  | "onPrimary"
  | "primary"
  | "outlinePrimary"
  | "neutral"
  | "dark"
  | "danger"
  | "subtleDanger"
  | "ghost";

type ButtonSize = "sm" | "md" | "lg";

interface CustomButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  showArrow?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  onPrimary: "bg-white text-[#2F278D] hover:bg-white/95",
  primary: "bg-[#6C5CE7] text-white hover:bg-[#6051ce]",
  outlinePrimary:
    "border border-[#6C5CE7] text-[#6C5CE7] bg-transparent hover:bg-[#F0E2FF]",
  neutral: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  dark: "bg-gray-800 text-white hover:bg-gray-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
  subtleDanger: "bg-red-50 text-red-500 hover:bg-red-100",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-3 text-sm",
  lg: "px-5 py-3.5 text-sm",
};

const arrowColorClasses: Record<ButtonVariant, string> = {
  onPrimary: "text-[#2F278D]/50",
  primary: "text-white/60",
  outlinePrimary: "text-[#2F278D]/50",
  neutral: "text-gray-700/50",
  dark: "text-white/60",
  danger: "text-white/70",
  subtleDanger: "text-red-500/60",
  ghost: "text-gray-700/50",
};

const CustomButton: React.FC<CustomButtonProps> = ({
  children,
  className = "",
  variant = "primary",
  size = "md",
  fullWidth = false,
  showArrow = true,
  leadingIcon,
  trailingIcon,
  type = "button",
  ...props
}) => {
  const hasRoundedClass = className.includes("rounded-");
  return (
    <button
      type={type}
      className={`inline-flex items-center font-bold justify-between gap-2 ${hasRoundedClass ? "" : "rounded-xl"} outfit-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon ? (
        trailingIcon
      ) : showArrow ? (
        <ArrowBendDoubleUpRight className={`h-5 w-5 ${arrowColorClasses[variant]}`} />
      ) : null}
    </button>
  );
};

export default CustomButton;