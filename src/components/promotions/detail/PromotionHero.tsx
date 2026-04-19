import { Promotion } from "@/data/promotions";
import { MapPin, Share2, Heart, Printer, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const badgeStyles = {
  hot: "bg-orange-500/10 text-orange-600 border-orange-200",
  exclusive: "bg-violet-500/10 text-violet-600 border-violet-200",
  new: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
};

const badgeLabels = {
  hot: "🔥 Alta demanda",
  exclusive: "⭐ Exclusiva",
  new: "✨ Nueva",
};

export function PromotionHero({ promotion: p }: { promotion: Promotion }) {
  const galleryImages = [
    p.image || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=500&fit=crop",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop",
  ];

  return (
    <div className="space-y-4">
      {/* Gallery */}
      <div className="grid grid-cols-4 grid-rows-2 gap-1.5 h-[340px] rounded-2xl overflow-hidden">
        <div className="col-span-2 row-span-2 relative group cursor-pointer">
          <img src={galleryImages[0]} alt={p.name} className="w-full h-full object-cover" />
          {p.badge && (
            <Badge className={`absolute top-3 left-3 ${badgeStyles[p.badge]} border font-medium text-xs`}>
              {badgeLabels[p.badge]}
            </Badge>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </div>
        {galleryImages.slice(1, 4).map((src, i) => (
          <div key={i} className="overflow-hidden cursor-pointer group">
            <img src={src} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          </div>
        ))}
        <div className="relative overflow-hidden cursor-pointer group">
          <img src={galleryImages[4]} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">+12 fotos</span>
          </div>
        </div>
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-lg font-semibold text-foreground tracking-tight">{p.name}</h1>
            <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">{p.code}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="text-sm">{p.location}, España</span>
            <span className="text-xs">·</span>
            <span className="text-sm">{p.propertyTypes.join(", ")}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Desarrollado por <span className="font-medium text-foreground">{p.developer}</span></p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Share2 className="h-3 w-3" /> Compartir
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Printer className="h-3 w-3" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <ExternalLink className="h-3 w-3" /> Crear mi landing
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Heart className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
