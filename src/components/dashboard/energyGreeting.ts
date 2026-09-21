export function getEnergyGreeting(hour: number) {
  if (hour < 12) return { greeting: "Chào buổi sáng", message: "Khởi động ngày mới đầy năng lượng, cùng hoàn thành mục tiêu hôm nay!" };
  if (hour < 18) return { greeting: "Chào buổi chiều", message: "Giữ vững nhịp làm việc, mỗi việc hoàn thành là một bước tiến!" };
  return { greeting: "Chào buổi tối", message: "Cùng hoàn tất những việc quan trọng và khép lại một ngày hiệu quả!" };
}
