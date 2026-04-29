
import React, { useState } from 'react';
import { UserIcon, BuildingIcon } from 'lucide-react';

interface AvatarProps {
    src?: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    accountType?: 'personal' | 'business' | 'unknown';
    fallbackIcon?: React.ReactNode;
    className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ 
    src, 
    name, 
    size = 'md', 
    accountType = 'personal',
    fallbackIcon,
    className = ""
}) => {
    const [hasError, setHasError] = useState(false);

    const sizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-8 h-8',
        lg: 'w-10 h-10',
        xl: 'w-12 h-12'
    };

    const iconSizes = {
        sm: 12,
        md: 14,
        lg: 20,
        xl: 24
    };

    const displayFallback = !src || hasError;

    return (
        <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center overflow-hidden border border-gray-700 bg-gray-900 shrink-0 ${className}`}>
            {!displayFallback ? (
                <img 
                    src={src} 
                    alt={name || 'Avatar'} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setHasError(true)}
                />
            ) : (
                fallbackIcon || (
                    accountType === 'business' ? (
                        <BuildingIcon size={iconSizes[size]} className="text-sky-400" />
                    ) : (
                        <UserIcon size={iconSizes[size]} className="text-purple-400" />
                    )
                )
            )}
        </div>
    );
};
