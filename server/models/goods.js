'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Goods extends Model {
    static associate(models) {
      // A good belongs to a list
      Goods.belongsTo(models.List, {
        foreignKey: 'listId',
        as: 'list'
      });
      
      // A good can be reserved by a guest
      Goods.belongsTo(models.Guest, {
        foreignKey: 'reservedBy',
        as: 'reservedByGuest'
      });
    }
  }
  Goods.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false
    },
    listId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Lists',
        key: 'id'
      }
    },
    reservedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Guests',
        key: 'id'
      }
    },
    reservationDate: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Goods',
    tableName: 'Goods'
  });
  return Goods;
};