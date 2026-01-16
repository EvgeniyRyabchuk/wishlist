'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Guest extends Model {
    static associate(models) {
      // A guest can reserve many goods
      Guest.hasMany(models.Goods, {
        foreignKey: 'reservedBy',
        as: 'reservedGoods'
      });
    }
  }
  Guest.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    }
  }, {
    sequelize,
    modelName: 'Guest',
    tableName: 'Guests'
  });
  return Guest;
};