import {
    Bell,
    BookOpen,
    Briefcase,
    Calendar,
    Camera,
    Gamepad2,
    Gift,
    Hash,
    Heart,
    Home,
    MessageCircle,
    Music,
    Plane,
    Star,
    Users,
    Utensils,
    type LucideIcon
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
    hash: Hash,
    "message-circle": MessageCircle,
    users: Users,
    home: Home,
    star: Star,
    heart: Heart,
    bell: Bell,
    calendar: Calendar,
    camera: Camera,
    music: Music,
    "gamepad-2": Gamepad2,
    utensils: Utensils,
    plane: Plane,
    gift: Gift,
    "book-open": BookOpen,
    briefcase: Briefcase
};

export function ChannelIcon({
    icon,
    color,
    className
}: {
    icon?: string | null;
    color?: string | null;
    className?: string;
}) {
    const Icon = (icon && ICONS[icon]) || Hash;
    return <Icon className={className} style={color ? { color } : undefined} />;
}
