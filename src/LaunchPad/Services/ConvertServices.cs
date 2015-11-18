using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using LaunchPad.Models;
using LaunchPad.ViewModels;

namespace LaunchPad.Services
{
    //Converts ViewModel <-> Models
    public class ConvertServices
    {
        public static Script CreateScript(PowerShellViewModel vm, string userName)
        {
            //Auto Mapper
            Mapper.CreateMap<PowerShellViewModel, Script>();
            var script = Mapper.Map<PowerShellViewModel, Script>(vm);
            script.Author = userName;
            return script;
        }
    }
}
