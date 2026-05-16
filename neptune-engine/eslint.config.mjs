/**
 * ESLint Flat Config (v9+)
 * 层间 import 守护：确保 L2 engine 不依赖 L4 UI 层
 */
export default [
	{
		files: ["src/engine/**/*.ts"],
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["react", "*/react"],
							message: "[Layer] L2 engine 禁止依赖 React",
						},
						{
							group: ["*/components/*"],
							message: "[Layer] L2 engine 禁止依赖 L4 components",
						},
						{
							group: ["*/hooks/*"],
							message: "[Layer] L2 engine 禁止依赖 L4 hooks",
						},
						{
							group: ["*/screens/*"],
							message: "[Layer] L2 engine 禁止依赖 L4 screens",
						},
						{
							group: ["*/keybindings/*"],
							message: "[Layer] L2 engine 禁止依赖 L4 keybindings",
						},
					],
				},
			],
		},
	},
];
