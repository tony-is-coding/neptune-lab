import {SignJWT, jwtVerify} from 'jose';
import {config} from '../config';

/**
 * JWT Payload 接口
 */
export interface JwtPayload {
    userId: string;
    tenantId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

/**
 * Token 对象接口
 */
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * 认证服务类
 * 负责 JWT 的签发和验证
 */
export class AuthService {
    private accessTokenSecret: Uint8Array;
    private refreshTokenSecret: Uint8Array;
    private accessTokenExpiresIn: string;
    private refreshTokenExpiresIn: string;

    constructor() {
        // 将字符串密钥转换为 Uint8Array（jose 要求）
        this.accessTokenSecret = new TextEncoder().encode(config.jwt.secret);
        this.refreshTokenSecret = new TextEncoder().encode(config.jwt.secret + '-refresh');
        this.accessTokenExpiresIn = config.jwt.expiresIn;
        this.refreshTokenExpiresIn = config.jwt.refreshExpiresIn;
    }

    /**
     * 签发访问令牌
     * @param payload JWT 载荷
     * @returns 访问令牌字符串
     */
    async signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
        const token = await new SignJWT({...payload})
            .setProtectedHeader({alg: 'HS256'})
            .setIssuedAt()
            .setExpirationTime(this.accessTokenExpiresIn)
            .sign(this.accessTokenSecret);

        return token;
    }

    /**
     * 签发刷新令牌
     * @param payload JWT 载荷
     * @returns 刷新令牌字符串
     */
    async signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
        const token = await new SignJWT({...payload})
            .setProtectedHeader({alg: 'HS256'})
            .setIssuedAt()
            .setExpirationTime(this.refreshTokenExpiresIn)
            .sign(this.refreshTokenSecret);

        return token;
    }

    /**
     * 签发令牌对（访问令牌 + 刷新令牌）
     * @param payload JWT 载荷
     * @returns 令牌对
     */
    async signTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<TokenPair> {
        const [accessToken, refreshToken] = await Promise.all([
            this.signAccessToken(payload),
            this.signRefreshToken(payload),
        ]);

        // 计算访问令牌的过期时间（秒）
        const expiresIn = this.parseExpirationTime(this.accessTokenExpiresIn);

        return {
            accessToken,
            refreshToken,
            expiresIn,
        };
    }

    /**
     * 验证访问令牌
     * @param token 访问令牌字符串
     * @returns JWT 载荷
     * @throws 如果令牌无效或已过期
     */
    async verifyAccessToken(token: string): Promise<JwtPayload> {
        try {
            const {payload} = await jwtVerify(token, this.accessTokenSecret);
            return payload as unknown as JwtPayload;
        } catch (error) {
            throw new Error('无效的访问令牌');
        }
    }

    /**
     * 验证刷新令牌
     * @param token 刷新令牌字符串
     * @returns JWT 载荷
     * @throws 如果令牌无效或已过期
     */
    async verifyRefreshToken(token: string): Promise<JwtPayload> {
        try {
            const {payload} = await jwtVerify(token, this.refreshTokenSecret);
            return payload as unknown as JwtPayload;
        } catch (error) {
            throw new Error('无效的刷新令牌');
        }
    }

    /**
     * 解析过期时间字符串为秒数
     * @param timeString 时间字符串（如 "1h", "30m", "7d"）
     * @returns 秒数
     */
    private parseExpirationTime(timeString: string): number {
        const match = timeString.match(/^(\d+)([hmsd])$/);
        if (!match) {
            // 默认 1 小时
            return 3600;
        }

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 's':
                return value;
            case 'm':
                return value * 60;
            case 'h':
                return value * 3600;
            case 'd':
                return value * 86400;
            default:
                return 3600;
        }
    }

    /**
     * 从刷新令牌生成新的访问令牌
     * @param refreshToken 刷新令牌
     * @returns 新的令牌对
     * @throws 如果刷新令牌无效
     */
    async refreshTokens(refreshToken: string): Promise<TokenPair> {
        const payload = await this.verifyRefreshToken(refreshToken);

        // 生成新的令牌对
        return this.signTokenPair({
            userId: payload.userId,
            tenantId: payload.tenantId,
            email: payload.email,
            role: payload.role,
        });
    }
}

/**
 * 导出单例实例
 */
export const authService = new AuthService();
