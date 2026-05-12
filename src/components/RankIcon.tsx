import React from 'react';
import { Sprout, Wheat, Swords, Sparkles, Shield, Crown, Flame } from "lucide-react";

export function RankIcon({ iconId, className }: { iconId: string, className?: string }) {
    const props = { className: className || "w-4 h-4" };
    switch(iconId) {
        case "leaf": return <Sprout {...props} />;
        case "wheat": return <Wheat {...props} />;
        case "swords": return <Swords {...props} />;
        case "crystal": return <Sparkles {...props} />;
        case "shield": return <Shield {...props} />;
        case "crown": return <Crown {...props} />;
        case "flame": return <Flame {...props} />;
        default: return <Sprout {...props} />;
    }
}
