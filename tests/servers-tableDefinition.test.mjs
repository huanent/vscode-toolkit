import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildAlterTableSql,
	buildCreateTableSql,
	parseCreateTableDefinition,
	readTableDefinition,
} from '../src/features/servers/mysql/tableDefinition.ts';

const column = {
	name: 'id',
	type: 'INT',
	length: '',
	nullable: false,
	primaryKey: true,
	autoIncrement: true,
	defaultKind: 'none',
	defaultValue: '',
};
const escapeValue = value => `'${value.replaceAll("'", "''")}'`;

test('table definitions validate duplicate names and unsafe column types', () => {
	assert.throws(
		() => parseCreateTableDefinition({ name: 'items', columns: [column, column] }, new Set()),
		/duplicated/,
	);
	assert.throws(
		() =>
			parseCreateTableDefinition(
				{ name: 'items', columns: [{ ...column, type: 'INT; DROP TABLE items' }] },
				new Set(),
			),
		/unsupported type/,
	);
	assert.throws(
		() => parseCreateTableDefinition({ name: 'items', columns: [column] }, new Set(['items'])),
		/already exists/,
	);
});

test('column validation rejects invalid defaults and stale original columns', () => {
	assert.throws(
		() =>
			parseCreateTableDefinition(
				{ name: 'items', columns: [{ ...column, defaultKind: 'null' }] },
				new Set(),
			),
		/must be nullable/,
	);
	assert.throws(
		() =>
			parseCreateTableDefinition(
				{ name: 'items', columns: [{ ...column, originalName: 'missing' }] },
				new Set(),
				'items',
				new Set(['id']),
			),
		/no longer exists/,
	);
});

test('CREATE SQL quotes identifiers and delegates literal escaping', () => {
	const definition = parseCreateTableDefinition(
		{
			name: 'it`ems',
			columns: [
				column,
				{
					...column,
					name: 'label',
					type: 'VARCHAR',
					length: '64',
					primaryKey: false,
					autoIncrement: false,
					defaultKind: 'value',
					defaultValue: "it's",
				},
			],
		},
		new Set(),
	);
	assert.equal(
		buildCreateTableSql(definition, 'db`name', escapeValue),
		"CREATE TABLE `db``name`.`it``ems` (\n  `id` INT NOT NULL AUTO_INCREMENT,\n  `label` VARCHAR(64) NOT NULL DEFAULT 'it''s',\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
	);
});

test('ALTER SQL preserves rename semantics and rejects no-op changes', () => {
	const original = { name: 'items', columns: [{ ...column, originalName: 'id' }] };
	assert.throws(
		() => buildAlterTableSql(original, original, 'db', escapeValue),
		/No table changes/,
	);
	const desired = {
		name: 'renamed',
		columns: [{ ...column, originalName: 'id', name: 'item_id' }],
	};
	assert.equal(
		buildAlterTableSql(original, desired, 'db', escapeValue),
		'ALTER TABLE `db`.`items`\n  CHANGE COLUMN `id` `item_id` INT NOT NULL AUTO_INCREMENT,\n  RENAME TO `db`.`renamed`;',
	);
});

test('table metadata query uses parameters and normalizes columns', async () => {
	const connection = {
		query: async (sql, parameters) => {
			assert.match(sql, /WHERE TABLE_SCHEMA = \? AND TABLE_NAME = \?/);
			assert.deepEqual(parameters, ['db', 'items']);
			return [
				[
					{
						name: 'id',
						dataType: 'int',
						isNullable: 'NO',
						columnKey: 'PRI',
						columnDefault: null,
						extra: 'auto_increment',
					},
				],
			];
		},
	};
	assert.deepEqual(await readTableDefinition(connection, 'db', 'items'), {
		name: 'items',
		columns: [{ ...column, originalName: 'id' }],
	});
});
