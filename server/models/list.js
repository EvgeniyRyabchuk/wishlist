'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class List extends Model {
    static associate(models) {
      // A list belongs to a creator
      List.belongsTo(models.Creator, {
        foreignKey: 'creatorId',
        as: 'creator'
      });
      
      // A list can have many goods
      List.hasMany(models.Goods, {
        foreignKey: 'listId',
        as: 'goods'
      });
    }
  }
  List.init({
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    creatorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Creators',
        key: 'id'
      }
    },
    shareToken: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'List',
    tableName: 'Lists'
  });
  return List;
};