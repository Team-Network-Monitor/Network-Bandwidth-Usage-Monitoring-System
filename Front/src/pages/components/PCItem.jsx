import pcImage from "./assets/pciamge.png";

export default function PCItem({ pc, setClicked, active, restricted, limitExceeded }) {
  const getBorderColor = () => {
    if (restricted)    return "#f87171";
    if (limitExceeded) return "#f97316";
    if (active)        return "#4ade80";
    return "#6b7280";
  };

  const getLabelBg = () => {
    if (restricted)    return "#f87171";
    if (limitExceeded) return "#f97316";
    if (active)        return "#4ade80";
    return "#6b7280";
  };

  const hostname = (pc.hostname && pc.hostname !== "Unknown") ? pc.hostname : pc.id;
  const border   = getBorderColor();

  return (
    <div
      onClick={() => setClicked(pc.id)}
      style={{
        border:        `3px solid ${border}`,
        borderRadius:  "6px",
        padding:       "4px",
        position:      "relative",
        cursor:        "pointer",
        background:    "#0e1221",
        boxShadow:     `0 0 6px ${border}44`,
        transition:    "box-shadow 0.2s",
      }}
    >
      {/* Label */}
      <div style={{
        position:     "absolute",
        top:          0,
        left:         0,
        background:   getLabelBg(),
        color:        "#080b14",
        fontSize:     "9px",
        fontWeight:   700,
        fontFamily:   "'JetBrains Mono', monospace",
        padding:      "1px 5px",
        borderRadius: "3px 0 4px 0",
        maxWidth:     "90%",
        overflow:     "hidden",
        textOverflow: "ellipsis",
        whiteSpace:   "nowrap",
      }}>
        {hostname}
      </div>

      {/* PC image */}
      <img
        src={pcImage}
        alt={hostname}
        style={{
          width:   "100%",
          display: "block",
          opacity: active ? 1 : 0.4,
          filter:  active ? "none" : "grayscale(80%)",
        }}
      />
    </div>
  );
}