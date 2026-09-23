export function getEnergyGreeting(hour: number) {
  if (hour < 12) return { greeting: "Xin chào, chúc bạn một ngày làm việc hiệu quả!" };
  if (hour < 18) return { greeting: "Xin chào, chúc bạn một ngày làm việc đầy năng lượng!" };
  return { greeting: "Xin chào, cố gắng hoàn thành tốt nhiệm vụ nhé!" };
}
