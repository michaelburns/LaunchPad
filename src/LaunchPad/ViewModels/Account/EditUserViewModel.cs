using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;
using LaunchPad.Models;

namespace LaunchPad.ViewModels.Account
{
    public class EditUserViewModel
    {
        public ApplicationUser User { get; set; }

        [Display(Name = "Roles")]
        public IEnumerable<string> SelectedRoles { get; set; }
    }
}
