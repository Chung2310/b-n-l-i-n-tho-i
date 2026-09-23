export function getEnergyGreeting(hour: number) {
  if (hour < 12) return { greeting: "Xin chào, chúc bạn một ngày làm việc hiệu quả!" };
  if (hour < 18) return { greeting: "Xin chào, chúc bạn một ngày làm việc đầy năng lượng!" };
  return { greeting: "Xin chào, cố gắng hoàn thành tốt nhiệm vụ nhé!" };
}

export function getEnthusiasticGreeting(hour: number, name: string) {
  const isNight = hour >= 18 || hour < 6;
  const isMorning = hour >= 6 && hour < 12;

  // 3-4 lời chào hứng khởi cho mỗi buổi trong ngày
  const morningGreetings = [
    `Chào buổi sáng đầy hứng khởi, cùng bứt phá mục tiêu hôm nay nhé ${name}!`,
    `Một ngày mới tràn đầy năng lượng và bão đơn nhé ${name}!`,
    `Khởi đầu ngày mới thật rực rỡ và gặt hái nhiều thành công nhé ${name}!`,
    `Sẵn sàng đón nhận những cơ hội tuyệt vời hôm nay nhé ${name}!`,
  ];

  const afternoonGreetings = [
    `Buổi chiều bứt tốc, chốt đơn mỏi tay và ngập tràn năng lượng nhé ${name}!`,
    `Nạp thêm năng lượng để cùng đồng đội cán đích ngoạn mục nhé ${name}!`,
    `Giữ vững phong độ đỉnh cao và tăng tốc vượt chỉ tiêu nhé ${name}!`,
    `Chúc ${name} một buổi chiều làm việc thật hứng khởi và năng suất!`,
  ];

  const eveningGreetings = [
    `Tối rồi, hoàn tất công việc êm đẹp và thư giãn nạp lại năng lượng nhé ${name}!`,
    `Cảm ơn những nỗ lực tuyệt vời của ${name} hôm nay, buổi tối thật thư thái nhé!`,
    `Đã làm việc chăm chỉ cả ngày rồi, chúc ${name} một buổi tối ấm áp và bình yên!`,
    `Một ngày cống hiến trọn vẹn, nghỉ ngơi thật ngon để ngày mai tiếp tục tỏa sáng nhé ${name}!`,
  ];

  const list = isNight ? eveningGreetings : isMorning ? morningGreetings : afternoonGreetings;
  const index = (new Date().getDate() + hour) % list.length;

  return {
    isNight,
    greeting: list[index],
    period: isNight ? "night" : isMorning ? "morning" : "afternoon",
  };
}
