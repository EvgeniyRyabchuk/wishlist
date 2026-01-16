'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Creator extends Model {
    static associate(models) {
      // A creator can have many lists
      Creator.hasMany(models.List, {
        foreignKey: 'creatorId',
        as: 'lists'
      });
    }
  }
  Creator.init({
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
    modelName: 'Creator',
    tableName: 'Creators'
  });
  return Creator;
};