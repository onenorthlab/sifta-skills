#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const expectedCoreSkills = [
	"sifta-academic-graph",
	"sifta-candidate-dossier",
	"sifta-github-engineering",
	"sifta-linkedin-product-gtm",
	"sifta-outreach-copy",
	"sifta-review-feedback",
	"sifta-search",
];

const requiredInstallCommand = "npx -y skills add onenorthlab/sifta-skills -g --all";
const routeSkillNames = expectedCoreSkills.filter((name) => name !== "sifta-search");
const routerMaxLines = 140;
const routeMaxLines = 90;

function readArgValue(args, name) {
	const index = args.indexOf(name);
	if (index === -1) {
		return undefined;
	}

	const value = args[index + 1];
	if (!value || value.startsWith("--")) {
		throw new Error(`Missing value for ${name}`);
	}

	return value;
}

function fail(message) {
	throw new Error(message);
}

function readFile(filePath) {
	return fs.readFileSync(filePath, "utf8");
}

function parseSkillFile(skillPath) {
	const content = readFile(skillPath);
	const name = content.match(/^name:\s*([A-Za-z0-9_-]+)\s*$/m)?.[1];
	const version = content.match(
		/metadata:\s*[\s\S]*?\n\s+version:\s*["']?([0-9A-Za-z.-]+)["']?\s*$/m,
	)?.[1];

	return { name, version };
}

function splitLineCount(content) {
	return content.split("\n").length;
}

function listSkillDirs(root) {
	return fs
		.readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((name) => /^sifta-[a-z0-9-]+$/u.test(name))
		.filter((name) => fs.existsSync(path.join(root, name, "SKILL.md")))
		.sort();
}

function validateSourceSkills(expectedVersion) {
	const skillDirs = listSkillDirs(repoRoot);

	for (const expected of expectedCoreSkills) {
		if (!skillDirs.includes(expected)) {
			fail(`Missing required skill directory: ${expected}`);
		}
	}

	const versions = new Map();

	for (const skillName of skillDirs) {
		const skillPath = path.join(repoRoot, skillName, "SKILL.md");
		const content = readFile(skillPath);
		const parsed = parseSkillFile(skillPath);

		if (!parsed.name) {
			fail(`${skillPath} missing top-level name`);
		}

		if (parsed.name !== skillName) {
			fail(`${skillPath} name mismatch: expected ${skillName}, got ${parsed.name}`);
		}

		if (!parsed.version) {
			fail(`${skillPath} missing metadata.version`);
		}

		versions.set(skillName, parsed.version);

		if (skillName === "sifta-search") {
			const lineCount = splitLineCount(content);
			if (lineCount > routerMaxLines) {
				fail(`${skillPath} router is too large: ${lineCount} lines > ${routerMaxLines}`);
			}
			for (const reference of [
				"references/shared-gates.md",
				"references/cli-reference.md",
				"references/query-contract.md",
				"references/output-quality.md",
			]) {
				if (!content.includes(reference)) {
					fail(`${skillPath} missing router reference: ${reference}`);
				}
			}
		}

		if (routeSkillNames.includes(skillName)) {
			const lineCount = splitLineCount(content);
			if (lineCount > routeMaxLines) {
				fail(
					`${skillPath} route skill is too large: ${lineCount} lines > ${routeMaxLines}`,
				);
			}
			for (const reference of [
				"../sifta-search/references/shared-gates.md",
				"../sifta-search/references/cli-reference.md",
				"../sifta-search/references/query-contract.md",
				"../sifta-search/references/output-quality.md",
			]) {
				if (!content.includes(reference)) {
					fail(`${skillPath} missing route reference: ${reference}`);
				}
			}
		}
	}

	const uniqueVersions = [...new Set(versions.values())];
	if (uniqueVersions.length !== 1) {
		fail(`Skill versions are not aligned: ${JSON.stringify(Object.fromEntries(versions))}`);
	}

	const suiteVersion = uniqueVersions[0];
	if (expectedVersion && suiteVersion !== expectedVersion) {
		fail(`Expected suite version ${expectedVersion}, got ${suiteVersion}`);
	}

	return { skillDirs, suiteVersion };
}

function validateDocs() {
	const readmePath = path.join(repoRoot, "README.md");
	const cliReferencePath = path.join(repoRoot, "sifta-search", "references", "cli-reference.md");
	const docs = [
		{ label: "README.md", content: readFile(readmePath) },
		{ label: "sifta-search/references/cli-reference.md", content: readFile(cliReferencePath) },
	];

	for (const doc of docs) {
		if (doc.content.includes("onenorthkaton/sifta-skills")) {
			fail(`${doc.label} still references old onenorthkaton/sifta-skills repository`);
		}

		if (!doc.content.includes(requiredInstallCommand)) {
			fail(`${doc.label} missing install fallback command: ${requiredInstallCommand}`);
		}

		if (
			/sifta-cli auth [^\n]+--base-url ["']?https:\/\/sifta\.onenorthdev\.com\/api/u.test(
				doc.content,
			)
		) {
			fail(`${doc.label} forces default SaaS --base-url in auth example`);
		}
	}
}

function validateInstalledRoot(installedRoot, sourceSkillDirs, suiteVersion) {
	for (const skillName of sourceSkillDirs) {
		const skillPath = path.join(installedRoot, skillName, "SKILL.md");
		if (!fs.existsSync(skillPath)) {
			fail(`Installed root missing ${skillName}: ${skillPath}`);
		}

		const parsed = parseSkillFile(skillPath);
		if (parsed.name !== skillName) {
			fail(`Installed ${skillPath} name mismatch`);
		}

		if (parsed.version !== suiteVersion) {
			fail(
				`Installed ${skillPath} version mismatch: expected ${suiteVersion}, got ${parsed.version}`,
			);
		}
	}
}

const args = process.argv.slice(2);
const expectedVersion = readArgValue(args, "--version");
const installedRoot = readArgValue(args, "--installed-root");

const { skillDirs, suiteVersion } = validateSourceSkills(expectedVersion);
validateDocs();

if (installedRoot) {
	validateInstalledRoot(path.resolve(installedRoot), skillDirs, suiteVersion);
}

console.log(
	JSON.stringify(
		{
			ok: true,
			suite_version: suiteVersion,
			skill_count: skillDirs.length,
			skills: skillDirs,
			checked_installed_root: Boolean(installedRoot),
		},
		null,
		2,
	),
);
