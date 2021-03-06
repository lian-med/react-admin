import React, {Component} from 'react';
import {Form, Button, Tag} from 'antd';
import {FormElement, FormRow, Table, tableEditable} from 'src/library/components';
import config from 'src/commons/config-hoc';
import PageContent from 'src/layouts/page-content';
import './style.less';

const EditTable = tableEditable(Table);

const DB_URL_STORE_KEY = 'GEN_DB_URL';

const renderContent = (value, record) => {
    const obj = {
        children: value,
        props: {},
    };
    if (record.isTable) {
        obj.props.colSpan = 0;
    }
    return obj;
};

@config({ajax: true})
export default class Fast extends Component {
    state = {
        loading: false,
        selectedRowKeys: [],
        dataSource: [],
    };

    columns = [
        {title: '表名', dataIndex: 'tableName', width: 200},
        {title: '数据库注释', dataIndex: 'comment', width: 250},
        {
            title: '中文名', dataIndex: 'chinese', width: 250,
            elementProps: record => {
                return {
                    required: true,
                    onBlur: (e) => {
                        record.chinese = e.target.value;
                    },
                };
            },
            render: renderContent,
        },
        {
            title: '列名', dataIndex: 'field',
            elementProps: record => {
                if (record.isTable) return null;

                return {
                    required: true,
                    onBlur: (e) => {
                        record.field = e.target.value;
                    },
                };
            },
            render: (value, record) => {
                if (record.isTable) {
                    const configMap = {
                        listPage: '列表页 orange',
                        query: '查询条件 gold',
                        selectable: '可选中 lime',
                        pagination: '分页 green',
                        serialNumber: '序号 cyan',
                        add: '添加 blue',
                        operatorEdit: '编辑 geekblue',
                        operatorDelete: '删除 red',
                        batchDelete: '批量删除 red',
                        modalEdit: '弹框编辑 purple',
                        pageEdit: '页面编辑 purple',
                    };

                    const tags = Object.entries(configMap).map(([key, value]) => {
                        const enabled = record[key];
                        let [label, color] = value.split(' ');
                        if (!enabled) color = 'gray';

                        return (
                            <Tag
                                key={label}
                                color={color}
                                styleName="tag"
                                onClick={() => {
                                    let nextEnabled = !record[key];
                                    if (key === 'listPage') {
                                        Object.keys(configMap).forEach(k => {
                                            if (k !== 'modalEdit' && k !== 'pageEdit') {
                                                record[k] = nextEnabled;
                                            }
                                        });

                                    } else if (key === 'modalEdit' && nextEnabled) {
                                        record.modalEdit = true;
                                        record.pageEdit = false;
                                    } else if (key === 'pageEdit' && nextEnabled) {
                                        record.pageEdit = true;
                                        record.modalEdit = false;
                                    } else {
                                        record[key] = nextEnabled;
                                        if (key !== 'modalEdit' && key !== 'pageEdit' && nextEnabled) {
                                            record.listPage = true;
                                        }
                                    }
                                    this.setState({dataSource: [...this.state.dataSource]});
                                }}
                            >
                                {label}
                            </Tag>
                        );

                    });

                    return {
                        children: tags,
                        props: {
                            colSpan: 2,
                        },
                    };
                }
                return value;
            },
        },
        // {title: '长度', dataIndex: 'length'},
        // {title: '是否为空', dataIndex: 'nullable'},
    ];

    componentDidMount() {
        const dbUrl = window.localStorage.getItem(DB_URL_STORE_KEY);
        if (dbUrl) {
            this.form.setFieldsValue({dbUrl});
            // 初始化查询
            this.form.submit();
        }
    }

    handleSubmit = (values) => {
        this.setState({loading: true});
        this.props.ajax.get('/gen/tables', values, {baseURL: '/'})
            .then(res => {
                const tables = res.tables || {};
                const ignoreFields = res.ignoreFields || [];
                const selectedRowKeys = [];

                const dataSource = tables.map(({name: tableName, comment, columns}) => {
                    const id = tableName;
                    selectedRowKeys.push(id);
                    return {
                        id,
                        isTable: true,
                        tableName,
                        comment,
                        listPage: true,
                        query: true,
                        selectable: true,
                        pagination: true,
                        serialNumber: true,
                        add: true,
                        operatorEdit: true,
                        operatorDelete: true,
                        batchDelete: true,

                        modalEdit: true,
                        pageEdit: false,
                        children: columns.map(it => {
                            const {camelCaseName, name, type, isNullable, comment, chinese, length} = it;
                            const id = `${tableName}-${name}`;

                            if (!ignoreFields.includes(name)) selectedRowKeys.push(id);

                            return {
                                id,
                                tableName,
                                field: camelCaseName,
                                comment: comment,
                                chinese: chinese || camelCaseName,
                                name,
                                length,
                                type,
                                isNullable,
                            };
                        }),
                    };
                });
                this.setState({dataSource, selectedRowKeys});
            })
            .finally(() => this.setState({loading: false}));
    };

    handleDbUrlChange = (e) => {
        const dbUrl = e.target.value;

        // 进行本地存储，记录数据库地址，使用原生存储，不区分用户
        window.localStorage.setItem(DB_URL_STORE_KEY, dbUrl);
    };

    handleGen = () => {
        const {selectedRowKeys, dataSource} = this.state;
        const tables = dataSource.filter(item => selectedRowKeys.includes(item.id));
        const result = tables.map(item => {
            const children = item.children
                .filter(it => selectedRowKeys.includes(it.id))
                .map(it => ({
                    field: it.field,
                    chinese: it.chinese,
                    name: it.name,
                    type: it.type,
                    length: it.length,
                    isNullable: it.isNullable,
                }));

            return {
                ...item,
                children,
            };
        });
        const params = {
            tables: result,
        };
        this.setState({loading: true});
        this.props.ajax.post('/gen/tables', params, {baseURL: '/'})
            .then(res => {
                console.log(res);
            })
            .finally(() => this.setState({loading: false}));
    };

    render() {
        const {dataSource, selectedRowKeys, loading} = this.state;

        const formProps = {
            width: '50%',
        };
        return (
            <PageContent style={{padding: 0, margin: 0}} loading={loading}>
                <Form
                    ref={form => this.form = form}
                    onFinish={this.handleSubmit}
                >
                    <FormRow>
                        <FormElement
                            {...formProps}
                            label="数据库地址"
                            name="dbUrl"
                            required
                            onChange={this.handleDbUrlChange}
                        />
                        <Button style={{margin: '0 8px'}} type="primary" htmlType="submit">获取数据库表</Button>
                        <Button onClick={this.handleGen}>生成选中表</Button>
                    </FormRow>
                </Form>
                <EditTable
                    rowSelection={{
                        selectedRowKeys,
                        onChange: selectedRowKeys => this.setState({selectedRowKeys}),
                    }}
                    dataSource={dataSource}
                    columns={this.columns}
                    rowKey="id"
                />
            </PageContent>
        );
    }
}
