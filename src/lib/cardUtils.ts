export function preloadCards() {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const suitMap: Record<string, string> = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
  
  const images = ["/cards/back.svg"];
  suits.forEach(suit => {
    ranks.forEach(rank => {
      images.push(`/cards/${rank}${suitMap[suit]}.svg`);
    });
  });

  images.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}
