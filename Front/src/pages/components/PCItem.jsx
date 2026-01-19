import pcImage from "./assets/pciamge.png";

export default function PCItem({ pc, setClicked, active, restricted }) {
  console.log("((((((((((((((((((((((((((((", pc.mac, active, restricted);
  const getBorderColor = () => {
    if (restricted) {
      return "border-red-500";
    } else if (active) {
      return "border-green-400";
    } else {
      return "border-gray-400";
    }
  };

  const getLabelColor = () => {
    if (restricted) {
      return "bg-red-500";
    } else if (active) {
      return "bg-green-400";
    } else {
      return "bg-gray-400";
    }
  };

  return (
    <div
      className={`border-4 hover:cursor-pointer ${getBorderColor()} p-1 rounded-md `}
      onClick={() => setClicked(pc.id)}
    >
      <div
        className={`absolute ${getLabelColor()} px-[2px] rounded-br-md rounded-tl-md`}
      >
        {pc.id}
      </div>
      <img src={pcImage} alt="" />
    </div>
  );
}
