import React from "react";

interface AddProps {
  color?: string;
}

const Add: React.FC<AddProps> = ({ color = "black" }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 48 48"
    >
      <g
        fill={color}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="4"
      >
        <rect width="36" height="36" x="6" y="6" rx="3" />
        <path strokeLinecap="round" d="M24 16v16m-8-8h16" />
      </g>
    </svg>
  );
};

export default Add;
